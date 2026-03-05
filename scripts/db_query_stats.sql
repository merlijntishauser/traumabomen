SELECT
    LEFT(query, 120) AS query_truncated,
    calls,
    ROUND((total_exec_time)::numeric, 2) AS total_ms,
    ROUND((mean_exec_time)::numeric, 2) AS mean_ms,
    ROUND((max_exec_time)::numeric, 2) AS max_ms,
    rows
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = 'traumabomen')
  AND query NOT LIKE '%pg_stat%'
ORDER BY total_exec_time DESC
LIMIT 20;
