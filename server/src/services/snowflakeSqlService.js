import snowflake from 'snowflake-sdk';

// 1. Initialize a Connection Pool
// Connection pooling is REQUIRED in Express to safely handle concurrent requests.
const pool = snowflake.createPool({
  account: process.env.SNOWFLAKE_ACCOUNT,
  username: process.env.SNOWFLAKE_USERNAME,
  password: process.env.SNOWFLAKE_PASSWORD,
  warehouse: process.env.SNOWFLAKE_WAREHOUSE,
  database: process.env.SNOWFLAKE_DATABASE,
  schema: process.env.SNOWFLAKE_SCHEMA,
  role: process.env.SNOWFLAKE_ROLE,
}, {
  max: 10,
  min: 0
});

export const callSnowflakeLLM = (prompt) => {
  return new Promise((resolve, reject) => {
    // 2. Safely check out a connection from the pool
    pool.use(async (connection) => {
      return new Promise((res, rej) => {
        const modelName = process.env.SNOWFLAKE_MODEL || 'claude-3-5-sonnet';
        const sqlText = `SELECT SNOWFLAKE.CORTEX.COMPLETE('${modelName}', ?) AS AI_RESPONSE`;

        connection.execute({
          sqlText,
          binds: [prompt],
          complete: (err, stmt, rows) => {
            if (err) {
              console.error('Cortex SQL execution failed:', err.message);
              return rej(err);
            }
            
            const responseText = rows && rows.length > 0 ? rows[0].AI_RESPONSE : '';
            res(responseText);
          }
        });
      });
    }).then(resolve).catch(reject);
  });
};