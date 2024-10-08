module.exports = {
    roots: ['.'],
    testMatch: ['**/tests/**/*.+(ts|tsx|js)', '**/?(*.)+(spec|test).+(ts|tsx|js)'],
    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest',
    },

    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
    },
}
