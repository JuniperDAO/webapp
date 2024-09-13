import { userContext } from '@/context/user/userContext'
import { useContext, useEffect, useState } from 'react'
import styles from '@/styles/ReferredByView.module.css'
import { GET, PUT } from '@/libs/request'
import { analytics } from '@/libs/evkv'
import { toast } from 'sonner'

interface ReferredByViewProps {
    onReferredBySet?: (code: string) => void
}

const ReferredByView: React.FC<ReferredByViewProps> = ({ onReferredBySet }) => {
    const [inputCode, setInputCode] = useState('')
    const [inputCodeError, setInputCodeError] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const { user, setUser } = useContext(userContext)

    const handleInputChange = (ev) => {
        setInputCode(ev.target.value)
    }

    const handleKeyDown = (ev) => {
        if (ev.key === 'Enter') {
            ev.preventDefault()
            handleSubmit()
        }
    }

    const handleSubmit = async () => {
        setIsSubmitting(true)

        const res = await PUT(`/api/referrals/${inputCode}`)

        if (res.status == 200) {
            setUser({
                ...user,
                referredBy: inputCode,
            })

            onReferredBySet(inputCode)

            toast.success(`"${inputCode}" is set as your referring Juniper user.`)
        } else if (res.status == 404) {
            setInputCodeError(`Referral code "${inputCode}" not found. Try again?`)
        } else {
            if (res.data.error) {
                setInputCodeError(res.data.message)
            }
        }

        setIsSubmitting(false)
    }

    return (
        <div>
            <p className="spectral text-xl text-center text-dark">Did someone refer you to Juniper?</p>
            <div className="flex justify-center items-center">
                <p className={`mt-1 max-w-sm mx-auto text-light leading-tight ${inputCodeError ? 'text-red-500' : ''}`}>
                    {inputCodeError ? inputCodeError : 'If so, enter their referral code here.'}
                </p>
            </div>
            <div className="flex justify-center items-center mx-4">
                <input
                    className={styles.input}
                    disabled={isSubmitting}
                    type="text"
                    value={inputCode}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter referral code and press Enter"
                />
            </div>
            <div className="flex flex-col gap-3 mt-4 md:mt-6">
                <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !inputCode?.length}
                    className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''} `}>
                    {isSubmitting ? 'Setting...' : 'Credit Referrer'}
                </button>
            </div>
        </div>
    )
}

export default ReferredByView
