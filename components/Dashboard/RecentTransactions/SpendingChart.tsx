import { YAxis, BarChart, Bar, LabelList, ResponsiveContainer, Tooltip } from 'recharts'
import TransactionsChartSkeleton from './Skeleton'
import { TransactionsContext } from '@/context/Transactions/TransactionsContext'
import { useContext, useEffect, useState } from 'react'
import { formatMoney } from '@/libs/util/formatMoney'
import { TransactionChunk } from '@/context/Transactions/TransactionChunker'
import { formatMonthForDisplay } from '@/libs/util/time'

export function SpendingChart() {
    const { isLoadingInitial, isPaginating, txnsByMonth } = useContext(TransactionsContext)
    const [chartData, setChartData] = useState<MonthChartDisplayData[]>([])
    const [totalSpend, setTotalSpend] = useState<number>(0)

    useEffect(() => {
        if (!txnsByMonth) return

        const data = formatMonthlyDataForDisplay(txnsByMonth)

        setTotalSpend(data ? data[0]?.spend : 0)
        setChartData(data)
    }, [txnsByMonth])

    if (isPaginating || isLoadingInitial) return <TransactionsChartSkeleton />

    // if the user has no transactions, we don't want to show the chart
    if (!totalSpend) return null

    return (
        <div className="h-[140px] md:h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={chartData}
                    margin={{
                        top: 10,
                        right: 0,
                        left: 0,
                        bottom: 0,
                    }}>
                    <Tooltip content={<CustomTooltip />} />
                    <YAxis mirror={true} axisLine={false} tickLine={false} />
                    {/* https://recharts.org/en-US/api/BarChart */}
                    <Bar type="monotone" dataKey="spend" stroke="#7A8670" fill="#BBBC7A4A">
                        <LabelList dataKey="monthFormatted" position="top" />
                    </Bar>
                    <Tooltip />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

type MonthChartDisplayData = {
    spend: number
    monthFormatted: string
}

// we take a maximum of 6 months with the most recent to the
// far right of the chart
const formatMonthlyDataForDisplay = (txnsByMonth: TransactionChunk[]): MonthChartDisplayData[] => {
    const MAX_MONTHS_DISPLAYED = 6
    const mostRecentMonths = txnsByMonth.slice(0, MAX_MONTHS_DISPLAYED)
    const orderedMonths = mostRecentMonths.reverse()

    return orderedMonths.map(formatMonthForChart)
}

const formatMonthForChart = (chunk: TransactionChunk): MonthChartDisplayData => {
    return {
        spend: chunk.totalSpend,
        monthFormatted: formatMonthForDisplay(chunk.startDate),
    }
}

const CustomTooltip = (data) => {
    const payload = data?.payload[0]?.payload
    if (!payload) return null
    const { monthFormatted, spend } = payload

    return (
        <div
            style={{
                width: 110,
                height: 70,
                backgroundColor: 'white',
                border: '1px solid lightgrey',
                padding: 10,
            }}>
            <p>{monthFormatted}</p>
            <p>{formatMoney(spend)}</p>
        </div>
    )
}
