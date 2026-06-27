const mongoose = require('mongoose');

/**
 * Execute a series of database operations with transactional guarantees.
 * Attempts to use Mongoose ACID transactions if supported by the DB.
 * If transactions are not supported (e.g. single-node local MongoDB or MongoMemoryServer),
 * falls back to executing the operations sequentially with manual rollback hook execution on failure.
 * 
 * @param {function(Object): Promise<any>} operations - Async callback that executes operations. Receives an object containing { session, isTransactional }.
 * @param {function(): Promise<any>} rollbackHook - Async callback called if operations fail in non-transactional mode.
 * @returns {Promise<any>} The result of the operations callback.
 */
const runInTransaction = async (operations, rollbackHook = null) => {
  let session = null;
  try {
    // Attempt to start a mongoose session
    session = await mongoose.startSession();
    session.startTransaction();

    // Run callback operations inside transaction
    const result = await operations({ session, isTransactional: true });

    // Commit if successful
    await session.commitTransaction();
    return result;
  } catch (error) {
    // If it's a "transaction not supported" error on single-node deployments
    const isUnsupported = error.message.includes('transaction') || 
                          error.message.includes('replica set') || 
                          error.code === 20 || 
                          error.codeName === 'IllegalOperation';

    if (isUnsupported && session) {
      // Clean up the session since transactions are unsupported
      session.endSession();
      session = null;
      console.warn('MongoDB deployment does not support transactions. Falling back to sequential execution with manual rollback hooks...');

      // Execute operations sequentially without a transaction session
      try {
        const result = await operations({ session: null, isTransactional: false });
        return result;
      } catch (sequentialError) {
        console.error('Sequential execution failed:', sequentialError.message);
        // Execute manual rollback hook if provided
        if (rollbackHook) {
          try {
            await rollbackHook();
            console.log('Manual rollback hook completed successfully.');
          } catch (rollbackErr) {
            console.error('Manual rollback hook also failed:', rollbackErr.message);
          }
        }
        throw sequentialError;
      }
    } else {
      // Standard transaction failure, abort
      if (session) {
        await session.abortTransaction();
      }
      throw error;
    }
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

module.exports = { runInTransaction };
