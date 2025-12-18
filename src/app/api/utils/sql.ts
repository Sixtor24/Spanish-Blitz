import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

const NullishQueryFunction = (() => {
  const fn: any = () => {
    throw new Error(
      'No database connection string was provided to `neon()`. Perhaps process.env.DATABASE_URL has not been set'
    );
  };
  fn.transaction = () => {
    throw new Error(
      'No database connection string was provided to `neon()`. Perhaps process.env.DATABASE_URL has not been set'
    );
  };
  return fn;
})();

const sql: NeonQueryFunction<false, false> = process.env.DATABASE_URL 
  ? neon(process.env.DATABASE_URL) 
  : NullishQueryFunction;

export default sql;