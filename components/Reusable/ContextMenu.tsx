import { useEffect, useState } from 'react'
import styles from '@/styles/ContextMenu.module.css'
import { IoMdMore } from 'react-icons/io'

type MenuProps = {
    children: JSX.Element
    isModal?: boolean
}

const ContextMenu = ({ children, isModal }: MenuProps) => {
    const [showMenu, setShowMenu] = useState(false)

    useEffect(() => {
        const handler = (e) => {
            setShowMenu(false)
        }

        window.addEventListener('click', handler)

        return () => {
            window.removeEventListener('click', handler)
        }
    }, [])

    const toggleMenu = (e) => {
        e.stopPropagation()

        setShowMenu((prev) => !prev)
    }

    return (
        <>
            {showMenu ? <div className={`overlay ${styles.overlay}`} /> : null}

            <div className={`${styles.menuIcon} ${isModal ? styles.modalMenu : ''}`}>
                <IoMdMore onClick={toggleMenu} />
            </div>
            {showMenu ? (
                <ul className={`${styles.options} ${isModal ? styles.modalOption : ''}`}>
                    {children}
                    <li className={styles.cancel}>Cancel</li>
                </ul>
            ) : null}
        </>
    )
}

export default ContextMenu
