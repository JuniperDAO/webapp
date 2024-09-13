export function formatAddress(input: string, prefix: number = 6, postfix: number = 4): string {
    if (!input) return '???...???'

    if (input.length <= 10) {
        return input
    } else {
        const firstSix = input.slice(0, prefix)
        const lastFour = input.slice(-postfix)
        return `${firstSix}...${lastFour}`
    }
}
