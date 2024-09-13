import React from 'react'

export default function Skeleton() {
    return (
        <div className="animate-pulse">
            <div className="bg-stone-200 h-3 w-1/4" />
            <div className="bg-stone-200 h-8 w-1/2 my-5" />
            <div className="bg-stone-200 h-3 w-1/3" />
        </div>
    )
}
