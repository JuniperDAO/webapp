import { AaveLoanInfo } from '@/libs/borrow/AaveLoanInfo'
import { toEth } from '@/libs/util/toEth'
import { ethers, BigNumber } from 'ethers'

test('_calculateMaxAvailableToBorrow should return the maximimum available to borrow', () => {
    const loanInfo = new AaveLoanInfo(ethers.constants.AddressZero)

    const maxBorrowWei = loanInfo._calculateMaxAvailableToBorrowWei({
        ltv: BigNumber.from(7000),
        totalCollateralBase: BigNumber.from(20000000000), // $200 collateral
        totalDebtBase: BigNumber.from(10000000000), // $100 debt
        percentOfMaxLTV: 100,
    })

    // max borrow should be 70% of collateral minus existing debt
    const expectedMaxBorrowUSD = 200 * 0.7 - 100
    const maxBorrowUSD = toEth(maxBorrowWei)

    expect(maxBorrowUSD).toEqual(expectedMaxBorrowUSD)
})

test('_calcIsSafeBorrowAmountWei should reject unsafe borrows', () => {
    const loanInfo = new AaveLoanInfo(ethers.constants.AddressZero)

    const isSafe1 = loanInfo._calcIsSafeBorrowAmountWei({
        targetAmountWei: loanInfo.baseToWei(BigNumber.from(71)),
        percentOfMaxLTV: 100,
        totalCollateralBase: BigNumber.from(100),
        totalDebtBase: BigNumber.from(0), // 0 debt
        ltv: BigNumber.from(7000),
    })

    expect(isSafe1).toEqual(false)

    const isSafe2 = loanInfo._calcIsSafeBorrowAmountWei({
        targetAmountWei: loanInfo.baseToWei(BigNumber.from(65)),
        percentOfMaxLTV: 50,
        totalCollateralBase: BigNumber.from(100),
        totalDebtBase: BigNumber.from(0), // 0 debt
        ltv: BigNumber.from(7000),
    })

    expect(isSafe2).toEqual(false)

    const isSafe3 = loanInfo._calcIsSafeBorrowAmountWei({
        targetAmountWei: loanInfo.baseToWei(BigNumber.from(65)),
        percentOfMaxLTV: 95,
        totalCollateralBase: BigNumber.from(100),
        totalDebtBase: BigNumber.from(0), // 0 debt
        ltv: BigNumber.from(7000),
    })

    expect(isSafe3).toEqual(true)
})
