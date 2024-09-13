import { userContext } from '@/context/user/userContext'
import { useContext } from 'react'

const discordInvite = 'https://discord.gg/qUkD5ugwBy'

const HelpMenu = () => {
    const { logout } = useContext(userContext)
    return (
        <>
            <li onClick={() => window.open(discordInvite, '_blank')}>Help</li>
            <li onClick={logout}>Logout</li>
        </>
    )
}

export default HelpMenu
