## Juniper webapp

This is an ERC-4337 smart wallet that provides simplified access to collateralized credit via Aave.

## Getting started

### Environment

```bash
POSTGRES_PRISMA_URL=

ALCHEMY_API_KEY
DUNE_API_KEY
NEXT_PUBLIC_INFURA_API_KEY
INFURA_API_SECRET
NEXT_PUBLIC_QUICKNODE_URL

COINBASE_OAUTH_CLIENT_SECRET
NEXT_PUBLIC_COINBASE_OAUTH_CLIENT_ID

NEXT_PUBLIC_ZERODEV_PROJECT_ID_OPTIMISM
NEXT_PUBLIC_BUNDLER_RPC
NEXT_PUBLIC_PAYMASTER_RPC

BRIDGE_XYZ_API_KEY

NEXT_PUBLIC_PRIVY_APP_ID
PRIVY_PUBLIC_KEY
PRIVY_SECRET_KEY

REDIS_URL

NEXT_PUBLIC_PLAID_CLIENT_ID
PLAID_SECRET

MAILCHIMP_API_KEY
MANDRILL_API_KEY

REFERRAL_BONUS_PAYER_USER_ID

OPTIMISM_ETHERSCAN_API_KEY

API_KEY
NEXT_PUBLIC_SENTRY_DSN
SENTRY_AUTH_TOKEN

NEXT_PUBLIC_CRISP_WEBSITE_ID
DEFERRED_EXECUTION_SECRET
```

### Dev Server

First, run the development server:

```bash
source .ops/env/activate.fish
./ops/dev.py
```

`dev.py` will update packages and start the development server. The server will be available at [http://localhost:3000](http://localhost:3000).

Note that while the webapp is in maintenance mode in prod, `update_deps()` in the `dev.py` script will not run.

## Learn More

To learn more about Next.js, take a look at the following resources:

-   [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
-   [Learn Next.js](https://nextjs.org/learn/foundations/about-nextjs) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!
