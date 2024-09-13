import Layout from '@/components/Reusable/Layout'
import styles from '@/styles/Settings.module.css'

export default function _Error() {
    return (
        <Layout>
            <div className={styles.container}>
                <button
                    type="button"
                    onClick={() => {
                        throw new Error('Sentry Frontend Error')
                    }}>
                    Throw error
                </button>
            </div>
        </Layout>
    )
}
