import styles from '@/styles/Home.module.css'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'

export const skeletonData = [
    {
        pv: 2400,
    },
    {
        pv: 1398,
    },
    {
        pv: 9800,
    },
    {
        pv: 3908,
    },
    {
        pv: 4800,
    },
    {
        pv: 3800,
    },
    {
        pv: 4300,
    },
]

export default function TransactionsChartSkeleton() {
    return (
        <div className={`${styles.transactionsSkeleton} animate-pulse`}>
            <div className="flex items-center justify-between p-4">
                <div className="bg-stone-200 h-5 w-1/3" />
                <div className="bg-stone-200 h-3 w-6" />
            </div>
            <div className="flex items-center justify-between px-5 mb-4">
                <div className="bg-stone-200 h-3 w-1/4" />
                <div className="bg-stone-200 h-3 w-1/4" />
            </div>

            <div className="h-[140px] md:h-[200px] border-b-2 border-b-stone-100">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={skeletonData}
                        syncId="anyId"
                        margin={{
                            top: 10,
                            right: 0,
                            left: 0,
                            bottom: 0,
                        }}>
                        <Area type="monotone" dataKey="pv" stroke="#ede8c1" fill="#f5f5f3" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            <div className="bg-stone-200 h-3 w-1/6 mx-auto my-2" />
        </div>
    )
}

const bigArr = new Array(7).fill(0).map((_, i) => i)
const smallArr = new Array(3).fill(0).map((_, i) => i)

export const TransactionsListSkeleton = ({ type }) => {
    const arr = type === 'big' ? bigArr : smallArr

    return (
        <div className={`${styles.transactionsSkeleton} animate-pulse pl-2 pr-2`}>
            {arr.map((num) => (
                <div key={num} className={styles.transaction}>
                    <div className="flex gap-2 items-center">
                        <div className="rounded-full bg-stone-200 h-10 w-10" />
                        <div className="space-y-2">
                            <div className="h-2 w-16 bg-stone-200 rounded" />
                            <div className="h-2 w-24 bg-stone-200 rounded" />
                        </div>
                    </div>

                    <div className="flex flex-col space-y-2 items-end">
                        <div className="h-2 w-16 bg-stone-200 rounded" />
                        <div className="h-2 w-24 bg-stone-200 rounded" />
                    </div>
                </div>
            ))}
        </div>
    )
}
