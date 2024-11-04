/** @type {import('next').NextConfig} */
const IS_PRODUCTION = process.env.BRANCH_NAME === 'main'
const IS_DEV = process.env.NODE_ENV === 'development' // !['main', 'staging'].includes(process.env.BRANCH_NAME)

module.exports = {
    output: 'export',

    // Required for GH Pages - modify path if repo name is different
    basePath: '/your-repo-name',
    images: {
        unoptimized: true,
    },

    reactStrictMode: false,
}
