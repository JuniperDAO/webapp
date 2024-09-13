import { AaveLoanInfo, AccountDataUSD } from '@/libs/borrow/AaveLoanInfo'

export const fetchCreditLineInfoForUI = async (address: string): Promise<AccountDataUSD> => {
    if (!address) throw new Error('No address provided to fetch credit line')
    return await new AaveLoanInfo(address).getAccountInfoUSD()
}
