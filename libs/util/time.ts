/**
 * Returns the local calendar day in the format YYYY-MM-DD
 */
export function getLocalDay(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * Returns the local calendar month in the format YYYY-MM
 */
export function getLocalMonth(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Returns the local calendar week number of the year
 */
export function getLocalWeek(date: Date): number {
    const jan1 = new Date(date.getFullYear(), 0, 1)
    const millisSinceJan1 = date.getTime() - jan1.getTime()
    const daysSinceJan1 = Math.floor(millisSinceJan1 / (24 * 60 * 60 * 1000))
    return Math.ceil((daysSinceJan1 + jan1.getDay() + 1) / 7)
}

export function oneMinuteBefore(dateStr: string): string {
    const date = new Date(dateStr)
    return new Date(date.getTime() - 60 * 1000).toISOString()
}

export function formatDateForDisplay(dateStr: string): string {
    const inputDate = new Date(dateStr)

    const today = new Date()
    today.setHours(0, 0, 0, 0) // Reset time parts to start of day

    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)

    if (inputDate.toDateString() === today.toDateString()) {
        return 'Today'
    } else if (inputDate.toDateString() === yesterday.toDateString()) {
        return 'Yesterday'
    } else {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        const day = inputDate.getDate()
        const month = monthNames[inputDate.getMonth()]
        const year = inputDate.getFullYear()

        const ordinal = (n: number) => {
            const s = ['th', 'st', 'nd', 'rd']
            const v = n % 100
            return s[(v - 20) % 10] || s[v] || s[0]
        }

        if (year === today.getFullYear()) {
            return `${month} ${day}${ordinal(day)}`
        } else {
            return `${month} ${day}${ordinal(day)}, ${year}`
        }
    }
}

export const formatMonthForDisplay = (dateStr: string): string => {
    const date = new Date(dateStr)
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth()

    const inputYear = date.getFullYear()
    const inputMonth = date.getMonth()

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

    const shortMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    if (inputYear === currentYear) {
        if (inputMonth === currentMonth) {
            return 'This Month'
        } else {
            return monthNames[inputMonth]
        }
    } else {
        return `${shortMonthNames[inputMonth]} ${inputYear}`
    }
}

export function formatFullDate(dateStr: string): string {
    const date = new Date(dateStr)

    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const day = date.getDate()
    let suffix = 'th'

    if (day % 10 === 1 && day !== 11) {
        suffix = 'st'
    } else if (day % 10 === 2 && day !== 12) {
        suffix = 'nd'
    } else if (day % 10 === 3 && day !== 13) {
        suffix = 'rd'
    }

    const hours = date.getHours()
    const minutes = date.getMinutes()

    const formattedTime = (hours > 12 ? hours - 12 : hours) + ':' + (minutes < 10 ? '0' + minutes : minutes) + ' ' + (hours >= 12 ? 'PM' : 'AM')
    return `${formattedTime}, ${months[date.getMonth()]} ${day}${suffix}, ${date.getFullYear()}`
}
