import { Loading } from '@/public/icons/StatusIcons'
import React from 'react'

type Props = {}

export const FullScreenSpinner = (props: Props) => {
    return (
        <>
            <div className="fixed top-0 left-0 bottom-0 right-0 w-screen h-screen flex items-center justify-center bg-white bg-opacity-75 z-50">
                <Loading />
            </div>
        </>
    )
}
