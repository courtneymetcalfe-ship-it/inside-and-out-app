# Account deletion

The function verifies the bearer token with Supabase Auth `getUser()` on every
request. Gateway legacy JWT verification is disabled to support current signing
keys; this does not permit anonymous deletion. The service key stays on the server.

The service-only preparation RPC validates every owned-profile choice in one
transaction. It transfers ownership and storage metadata or removes a profile and
queues its document prefix. Actual file deletion uses the Storage API, never SQL
deletion of storage metadata. Account deletion follows successful file cleanup.
Retrying a pending request resumes its saved choices; it does not redo transfers.

Deleting an account removes memberships/invitations and anonymises account
attribution. Family record contents and documents kept after a transfer may still
mention the person. Local device profiles and downloaded exports are not erased.

Release checks still required: real-device UI and end-to-end tests with disposable
accounts/files, including interrupted cleanup and transfers. Do not use real family
data for destructive testing. Publish the updated privacy policy before public release.
