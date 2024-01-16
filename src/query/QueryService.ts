class QueryService {

    /**
     Do provide the best effort for execute operation.

     Do implements internal busy loop until one of the following conditions is met:
     - deadline was canceled or deadlined
     - retry operation returned nil as error

     Warning: if context without deadline or cancellation func than Do can run indefinitely.
     */
    public do<T>(func: () => T): T { // TODO: pass a session without transaction
        throw new Error('Not implemented');
    }

    /**
     DoTx provide the best effort for execute transaction.

     DoTx implements internal busy loop until one of the following conditions is met:
     - deadline was canceled or deadlined
     - retry operation returned nil as error

     DoTx makes auto begin (with TxSettings, by default - SerializableReadWrite), commit and
     rollback (on error) of transaction.

     If op TxOperation returns nil - transaction will be committed
     If op TxOperation return non nil - transaction will be rollback
     Warning: if context without deadline or cancellation func than DoTx can run indefinitely
     */
    public doTx<T>(func: () => T): T { // TODO: pass a transaction
        throw new Error('Not implemented');
    }
}
