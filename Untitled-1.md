
# Additional rules by Mathes - will keep adding more.

# Claude Rules

1. Since we're in development phase, always show all error details as much as possible in UI. If there's a stacktrace, provide option to copy them (don't have to show the trace but copy).

2. Keep updating 'docs' as and when necessary.

3. After a signifiant piece of work is done, push the code the git unless we're not working on main branch.

====

1. contacts > click on a contact > segments = None... but in reality, they're part of a segment.

2. Edit configuration in email opens next screen where details are not pre-populated.

3. 'copy' feature in campaigns please.

4. Here's the log from background service on email send.

```
[2026-05-21 23:37:47.972 -0700] INFO: incoming request
    reqId: "req-1h"
    req: {
      "method": "POST",
      "url": "/api/campaigns",
      "hostname": "localhost:3001",
      "remoteAddress": "127.0.0.1",
      "remotePort": 64410
    }
[2026-05-21 23:37:48.790 -0700] INFO: request completed
    reqId: "req-1h"
    res: {
      "statusCode": 201
    }
    responseTime: 817.3760418891907
[2026-05-21 23:37:48.846 -0700] INFO: incoming request
    reqId: "req-1i"
    req: {
      "method": "POST",
      "url": "/api/campaigns/f92096ab-063e-43bf-b2f8-66e8dc51adbe/send",
      "hostname": "localhost:3001",
      "remoteAddress": "127.0.0.1",
      "remotePort": 64414
    }
[campaignEngine] Starting send for campaign f92096ab-063e-43bf-b2f8-66e8dc51adbe
(node:46151) Warning: NodeVersionSupportWarning: The AWS SDK for JavaScript (v3)
versions published after the first week of January 2027
will require node >=22. You are running node v21.1.0.

To continue receiving updates to AWS services, bug fixes,
and security updates please upgrade to node >=22.

More information can be found at: https://a.co/c895JFp
(Use `node --trace-warnings ...` to show where the warning was created)
(node:46151) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
[2026-05-21 23:37:49.340 -0700] INFO: request completed
    reqId: "req-1i"
    res: {
      "statusCode": 202
    }
    responseTime: 493.59912490844727
[campaignEngine] 2 contacts to send to
[campaignEngine] Failed to send to mathes.btech@gmail.com: html.replace is not a function
[campaignEngine] Failed to send to mat.mk88@gmail.com: html.replace is not a function
[campaignEngine] Campaign f92096ab-063e-43bf-b2f8-66e8dc51adbe complete — sent: 0, skipped: 0, errors: 2

```

6. contacts > segments > segment name - should be clickable