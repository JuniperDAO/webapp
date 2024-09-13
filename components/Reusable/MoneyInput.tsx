import React, { ChangeEvent, InputHTMLAttributes, ForwardedRef, forwardRef } from 'react'

interface MoneyInputProps extends InputHTMLAttributes<HTMLInputElement> {
    value?: string
    allowCents?: boolean
}

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(({ onChange, value, allowCents, ...props }, ref: ForwardedRef<HTMLInputElement>) => {
    const handleChange = (ev: ChangeEvent<HTMLInputElement>) => {
        console.log('Received an input', ev.target.value.toString())
        const inputValue = ev.target.value
        let formattedValueString = ''

        if (inputValue.length) {
            const onlyNumbers = allowCents ? inputValue.replace(/[^0-9]/g, '') : inputValue.replace(/[^0-9]\./g, '')

            let formattedValue = parseFloat(onlyNumbers)

            if (onlyNumbers.includes('.')) {
                formattedValue /= 100.0
                formattedValueString = formattedValue.toFixed(allowCents ? 2 : 0)
            } else {
                formattedValueString = formattedValue.toFixed(0)
            }

            console.log('Formatted input to: ', formattedValueString)
        }

        if (onChange) {
            const dummyEvent = {
                target: {
                    value: formattedValueString,
                },
            }
            onChange(dummyEvent as ChangeEvent<HTMLInputElement>)
        }
    }

    return <input value={value || '0'} {...props} ref={ref} type="text" onChange={handleChange} placeholder="0" />
})

MoneyInput.displayName = 'MoneyInput'
