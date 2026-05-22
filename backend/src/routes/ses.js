import {
  ListIdentitiesCommand,
  GetIdentityVerificationAttributesCommand,
} from '@aws-sdk/client-ses';
import { sesClient } from '../config/aws.js';
import { authenticate } from '../middleware/auth.js';

export default async function sesRoutes(fastify) {
  /**
   * GET /api/ses/identities
   * Returns all SES-verified email addresses and domains for this account.
   * Used by the campaign builder to validate/suggest from_email values.
   */
  fastify.get('/api/ses/identities', { preHandler: authenticate }, async (request, reply) => {
    try {
      // Fetch verified email addresses and domains separately
      const [emailRes, domainRes] = await Promise.all([
        sesClient.send(new ListIdentitiesCommand({ IdentityType: 'EmailAddress' })),
        sesClient.send(new ListIdentitiesCommand({ IdentityType: 'Domain' })),
      ]);

      const allIdentities = [
        ...(emailRes.Identities || []),
        ...(domainRes.Identities || []),
      ];

      fastify.log.info(
        { total: allIdentities.length },
        '[ses] Listed SES identities'
      );

      if (allIdentities.length === 0) {
        return reply.send({ emails: [], domains: [] });
      }

      // Get verification status for all identities
      const verifyRes = await sesClient.send(
        new GetIdentityVerificationAttributesCommand({ Identities: allIdentities })
      );

      const attrs = verifyRes.VerificationAttributes || {};

      const verifiedEmails = (emailRes.Identities || []).filter(
        (id) => attrs[id]?.VerificationStatus === 'Success'
      );
      const verifiedDomains = (domainRes.Identities || []).filter(
        (id) => attrs[id]?.VerificationStatus === 'Success'
      );

      fastify.log.info(
        { verifiedEmails: verifiedEmails.length, verifiedDomains: verifiedDomains.length },
        '[ses] Verified identities'
      );

      return reply.send({ emails: verifiedEmails, domains: verifiedDomains });
    } catch (err) {
      fastify.log.error({ err }, '[ses] Failed to list SES identities');
      return reply.code(500).send({ error: `Failed to fetch SES identities: ${err.message}` });
    }
  });
}
