import { safeStringify } from '@/libs/constants'
import { log } from '@/libs/util/log'
import * as Sentry from '@sentry/nextjs'

export enum MailchimpSlugs {
    // slugs differ from events in that they're dashed instead of underscored
    SendMoneyStarted = 'send-started',
    SendMoneyCompleted = 'send-completed',
    // DepositStarted = 'deposit-started',
    DepositCompleted = 'deposit-completed',
    // RepayStarted = 'repay-started',
    RepayCompleted = 'repay-completed',
    // WithdrawStarted = 'withdraw-started',
    WithdrawCompleted = 'withdraw-completed',
    ReferralSignedUp = 'referral-signed-up',
    ReferralPaid = 'referral-paid',
    ReferredPaid = 'referred-paid',
}

const mailchimpClient = require('@mailchimp/mailchimp_transactional')(process.env.MANDRILL_API_KEY)

export async function sendMailchimpTemplate(email: string, slug: string, properties = {}) {
    let response = null

    log(`DISABLED ${email} will not send slug ${slug} ${safeStringify(properties)}`)
    return

    try {
        const content = Object.entries(properties).map(([name, content]) => ({ name, content }))
        const payload = {
            template_name: slug, // the immutable slug of a template that exists in the user's account. Make sure you don't use the template name as this one might change.
            template_content: [{}], // an array of template content to send. Each item in the array should be a struct with two keys - name: the name of the content block to set the content for, and content: the actual content to put into the block
            message: {
                global_merge_vars: content, // the global merge variables to use for all merge tags in the message. You can override these per recipient
                to: [{ email }], // the email address of the recipient
            }, // the other information on the message to send - same as /messages/send, but without the html content
        }
        log(`${email} sending slug ${slug} ${safeStringify(payload)}`)
        const response = await mailchimpClient.messages.sendTemplate(payload)

        log(`${email} sent slug ${slug}: ${safeStringify(response)}`)
    } catch (e) {
        Sentry.captureException(e)
        log(`${email} failed slug ${slug} ${safeStringify(e)}`)
    }

    return response
}
