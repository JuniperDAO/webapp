import { ethers, BigNumber } from 'ethers'
import { toEth, toWei } from '../util/toEth'
import { AAVE_POOL_ABI } from '../deposit/AavePoolABI'
import { AaveV3Optimism } from '@bgd-labs/aave-address-book'
import { getReadProvider } from '../getReadProvider'
import { Network } from '../network/types'

import { log } from '@/libs/util/log'

export type RawAccountData = {
    totalCollateralBase: BigNumber
    totalDebtBase: BigNumber
    availableBorrowsBase: BigNumber
    currentLiquidationThreshold: BigNumber
    ltv: BigNumber
    healthFactor: BigNumber
}

export type AccountDataUSD = {
    totalCollateralUSD: number
    totalDebtUSD: number
    availableBorrowsUSD: number
    ltvBips: number
    liquidationBips: number
}

export type AccountDataWei = {
    totalCollateralWei: BigNumber
    totalDebtWei: BigNumber
    availableBorrowsWei: BigNumber
}

/**
 * AaveLoanInfo is a class that provides information about
 * a loan on Aave V3. When using this class make sure to
 * understand the units returned by each function to avoid
 * doing defi math wrong.
 *
 *  ______________________
 * < !! Check the Units !! >
 *  ----------------------
 *         \   ^__^
 *          \  (..)\_______
 *             (__)\       )\/\
 *                 ||----w |
 *                 ||     ||
 */
export class AaveLoanInfo {
    borrowerAddress: string
    aavePool: ethers.Contract

    constructor(borrowerAddress: string) {
        this.borrowerAddress = borrowerAddress
        this.aavePool = new ethers.Contract(AaveV3Optimism.POOL, AAVE_POOL_ABI, getReadProvider(Network.optimism))
    }

    // Note: AAVE V3 contracts are denominated in
    // USD with 8 decimals of precision, see documentation
    // https://docs.aave.com/developers/core-contracts/aaveoracle#getassetprice
    public async getRawAccountInfo(): Promise<RawAccountData> {
        // https://docs.aave.com/developers/core-contracts/pool#getuseraccountdata
        const {
            totalCollateralBase,
            totalDebtBase,
            availableBorrowsBase, // maximum Loan To Value of the user - weighted average of max ltv of collateral reserves
            currentLiquidationThreshold, // liquidation threshold of the user - weighted average of liquidtion threshold of collateral reserves
            ltv, // maximum Loan To Value of the user - weighted average of max ltv of collateral reserves
            healthFactor,
        } = await this.aavePool.getUserAccountData(this.borrowerAddress)

        return {
            totalCollateralBase,
            totalDebtBase,
            availableBorrowsBase,
            currentLiquidationThreshold,
            ltv,
            healthFactor,
        }
    }

    // we return the two digit floating point precision
    // of the USD value, e.g. $12.35
    public baseToUSD(base: BigNumber, roundUp: boolean = false): number {
        const cents = base.div(1e6)

        // Check to see if we need to round up
        const baseWithLossOfPrecicion = cents.mul(1e6)
        if (roundUp && baseWithLossOfPrecicion.lt(base)) {
            cents.add(2)
        }

        const dollars = cents.toNumber() / 100
        const dollarsFixed = dollars.toFixed(2)
        let dollarsFloat = parseFloat(dollarsFixed)

        // not sure about the rest of this function
        if (roundUp && base.gt(0) && dollarsFloat < 0.01) {
            dollarsFloat = 0.01
        }

        return dollarsFloat
    }

    // converts a base amount to wei
    // Base precision is 8 decimals
    // Wei precision is 18 decimals
    public baseToWei(base: BigNumber): BigNumber {
        const wei = base.mul(1e10)
        return wei
    }

    /**
     * We round up the totalDebtUSD so that when the user repays
     * their debt, the display value will display an amount which
     * can fully pay off their collateral. Otherwise they may be left
     * with a fraction of a cent of debt and unable to withdraw.
     *
     * This is necessary due to loss of precision from base -> cents.
     */
    public async getAccountInfoUSD(): Promise<AccountDataUSD> {
        const rawData = await this.getRawAccountInfo()

        const roundUp = true
        return {
            totalDebtUSD: this.baseToUSD(rawData.totalDebtBase, roundUp), // see above "round up" comment
            totalCollateralUSD: this.baseToUSD(rawData.totalCollateralBase),
            availableBorrowsUSD: this.baseToUSD(rawData.availableBorrowsBase),
            ltvBips: rawData.ltv.toNumber(),
            liquidationBips: rawData.currentLiquidationThreshold.toNumber(),
        }
    }

    public async getAccountInfoWei(): Promise<AccountDataWei> {
        const rawData = await this.getRawAccountInfo()

        return {
            totalDebtWei: this.baseToWei(rawData.totalDebtBase),
            totalCollateralWei: this.baseToWei(rawData.totalCollateralBase),
            availableBorrowsWei: this.baseToWei(rawData.availableBorrowsBase),
        }
    }

    // Note: LTV is denominated in bips 0-10000
    public ltvFloat(ltvBips: BigNumber): number {
        return ltvBips.toNumber() / 10000
    }

    // gets the percentage of the loan eligibility that is utilized
    public async getPercentOfMaxLTVUtilized(): Promise<number> {
        const { totalCollateralBase, totalDebtBase, ltv } = await this.getRawAccountInfo()

        // Note: LTV is denominated in bips 0-10000
        const totalPotentialDebtBase = totalCollateralBase.mul(ltv).div(10000)

        const bipsUtilized = totalDebtBase.mul(10000).div(totalPotentialDebtBase).toNumber()

        // Note: bips are 1/100 of a percent
        return bipsUtilized / 100
    }

    // returns how much you can borrow before reaching
    // the desired percent of loan utilization
    // NOTE: percent of max LTV is the percentage of the
    // max loan LTV to use. e.g. 70% of the max LTV (which might be 70% of the collateral itself)
    // we use % of % so we can be more conservative while still relying on AAVE ltv ratios
    // 💵 returns the amount in USD wei
    public async getAvailableToBorrow({ percentOfMaxLTV }: { percentOfMaxLTV: number }): Promise<BigNumber> {
        const { totalCollateralBase, totalDebtBase, ltv } = await this.getRawAccountInfo()

        log(
            `${this.borrowerAddress}: totalCollateralBase ${this.baseToUSD(totalCollateralBase)}, totalDebtBase ${this.baseToUSD(
                totalDebtBase
            )}, ltvBips ${ltv}`
        )

        return this._calculateMaxAvailableToBorrowWei({
            ltv,
            totalCollateralBase,
            totalDebtBase,
            percentOfMaxLTV,
        })
    }

    _calculateMaxAvailableToBorrowWei({ ltv, totalCollateralBase, totalDebtBase, percentOfMaxLTV }: CalculateAvailableToBorrowParams): BigNumber {
        if (percentOfMaxLTV > 100) {
            throw new Error('Cannot use more than 100% of the LTV')
        }

        const totalPotentialDebtBase = totalCollateralBase.mul(ltv).div(10000)

        const desiredBips = BigNumber.from(Math.floor(percentOfMaxLTV * 100))
        const totalDesiredDebtBase = totalPotentialDebtBase.mul(desiredBips).div(10000)

        const amountToBorrowBase = totalDesiredDebtBase.sub(totalDebtBase)
        const amountToBorrowWei = this.baseToWei(amountToBorrowBase)

        log(
            `${this.borrowerAddress}: totalPotentialDebtBase ${this.baseToUSD(
                totalPotentialDebtBase
            )}, desiredBips ${desiredBips}, desiredDebtAmount ${this.baseToUSD(totalDesiredDebtBase)}, amountToBorrowBasePrecision ${this.baseToUSD(
                amountToBorrowBase
            )}, amountToBorrowBase ${this.baseToUSD(amountToBorrowBase)}`
        )

        if (amountToBorrowWei.lte(0)) {
            const _ = this.baseToUSD(totalDebtBase) / this.baseToUSD(totalCollateralBase)
            log(
                `${this.borrowerAddress}: User is already >= desired utilization (${this.baseToUSD(totalDebtBase)}/${this.baseToUSD(
                    totalCollateralBase
                )} = ${_}), maxBips/100 ${ltv.mul(percentOfMaxLTV).div(10000)}`
            )

            return BigNumber.from(0)
        }

        return amountToBorrowWei
    }

    // returns if the borrow amount is safe given the desired max utilization %
    public async isSafeBorrowAmount({ targetAmountWei, percentOfMaxLTV }: IsSafeBorrowAmountParams): Promise<boolean> {
        const { totalCollateralBase, totalDebtBase, ltv } = await this.getRawAccountInfo()

        return this._calcIsSafeBorrowAmountWei({
            targetAmountWei,
            percentOfMaxLTV,
            totalCollateralBase,
            totalDebtBase,
            ltv,
        })
    }

    _calcIsSafeBorrowAmountWei({ targetAmountWei, percentOfMaxLTV, totalCollateralBase, totalDebtBase, ltv }: CalcIsSafeBorrowAmountParams): boolean {
        if (targetAmountWei.eq(0)) {
            throw new Error('Amount to borrow must be greater than 0')
        }

        // return early to avoid divide by zero
        if (totalCollateralBase.eq(0)) {
            return false
        }

        const totalCollateralWei = this.baseToWei(totalCollateralBase)
        const totalDebtWei = this.baseToWei(totalDebtBase)

        const proposedTotalDebtWei = totalDebtWei.add(targetAmountWei)

        const totalAvailableDebtWei = totalCollateralWei.mul(ltv).div(10000)

        const proposedPercentOfLTV = proposedTotalDebtWei.mul(100).div(totalAvailableDebtWei).toNumber()

        log(
            `${this.borrowerAddress}: target ${toEth(targetAmountWei)}, totalCollateralBase ${this.baseToUSD(totalCollateralBase)}, proposedTotalDebt ${toEth(
                proposedTotalDebtWei
            )}, totalAvailableDebtWei ${toEth(totalAvailableDebtWei)}, proposedPercentOfLTV ${proposedPercentOfLTV}, percentOfMaxLTV ${percentOfMaxLTV}`
        )
        return proposedPercentOfLTV < percentOfMaxLTV
    }

    public async getMaxSafeBorrowAmountForTarget({ targetAmountWei, percentOfMaxLTV }: GetMaxSafeBorrowForTargetParams): Promise<BigNumber> {
        const isSafeToBorrow = await this.isSafeBorrowAmount({
            targetAmountWei,
            percentOfMaxLTV,
        })

        if (isSafeToBorrow) {
            return targetAmountWei
        }

        return await this.getAvailableToBorrow({
            percentOfMaxLTV,
        })
    }
}

type CalculateAvailableToBorrowParams = {
    ltv: BigNumber
    totalCollateralBase: BigNumber
    totalDebtBase: BigNumber
    percentOfMaxLTV: number
}

type GetMaxSafeBorrowForTargetParams = {
    targetAmountWei: BigNumber
    percentOfMaxLTV: number
}

type IsSafeBorrowAmountParams = {
    targetAmountWei: BigNumber
    percentOfMaxLTV: number
}

type CalcIsSafeBorrowAmountParams = IsSafeBorrowAmountParams & {
    totalCollateralBase: BigNumber
    totalDebtBase: BigNumber
    ltv: BigNumber
}
