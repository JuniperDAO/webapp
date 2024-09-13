import React from 'react'
import styles from '@/styles/Home.module.css'
import { staticURL } from '@/libs/constants'

export default function Skeleton() {
    return (
        <div className={`${styles.usage} animate-pulse`}>
            <div className="bg-stone-200 h-5 w-1/3 mx-auto" />

            <div className={styles.stats}>
                <div className={styles.chart}>
                    <img
                        src={staticURL('/public/images/creditChart.png')}
                        width={250}
                        height={135}
                        alt="Chart"
                        style={{
                            filter: 'grayscale(100%)',
                            opacity: '0.4',
                        }}
                    />
                    <div style={{ rotate: '0deg' }} className={`${styles.circle}`} />
                </div>

                <div className="bg-stone-200 h-6 w-1/3 mx-auto -mt-10" />
            </div>
            <div className="bg-stone-200 h-6 w-1/3 mx-auto mt-12" />
            <div className="bg-stone-200 h-3 w-2/3 mx-auto mt-4" />
        </div>
    )
}
