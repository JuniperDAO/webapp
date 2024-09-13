import React, { useContext, useEffect } from 'react'
import { userContext } from '@/context/user/userContext'

const Logout: React.FC = () => {
    const { logout } = useContext(userContext)

    useEffect(() => {
        console.log('logging out')
        logout().then(null)
    }, [logout])

    return (
        <div
            style={{
                width: '100vw',
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
            logging out...
        </div>
    )
}

export default Logout
