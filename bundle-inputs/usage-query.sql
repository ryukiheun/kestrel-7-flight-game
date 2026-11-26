-- Usage rows for the flight-game build session, its two worker sessions,
-- the review session and the landing playtest session.
-- Query from bundle --help (step 1), model joined in. Run with the muse.db tool
-- AFTER the sessions have ended: Muse writes a message's usage row when the
-- message is delivered, and a session's row appears only once the session ends.
-- Build session id: 7c725903-48dd-4f7f-8d3c-3197ed33e44a
-- Worker sessions: 032a2af2-37b2-4ece-bde4-81450192c69a, 873e5956-f39e-4a89-9d15-b24978393299
-- Review session id: 9daf8d01-1818-40ce-a0d3-caf9c3b025db
-- Landing playtest session id: 477ea2bc-6d03-4e8d-a0cb-b110d88763df
SELECT u.agent_id AS agent_id, u.message_id AS message_id, u.created_at AS created_at, u.input_tokens AS input_tokens, u.output_tokens AS output_tokens, a.model AS model FROM agent.agent_message_token_usage u JOIN agent.agents a ON a.agent_id = u.agent_id WHERE u.agent_id IN ('7c725903-48dd-4f7f-8d3c-3197ed33e44a', '032a2af2-37b2-4ece-bde4-81450192c69a', '873e5956-f39e-4a89-9d15-b24978393299', '9daf8d01-1818-40ce-a0d3-caf9c3b025db', '477ea2bc-6d03-4e8d-a0cb-b110d88763df') ORDER BY u.created_at DESC LIMIT 500
