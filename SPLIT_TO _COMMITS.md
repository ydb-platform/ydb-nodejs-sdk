Got a lot of different changes in this brunch, which is better divided into separate commits

Commite plan:
- retryer, using query service as an example, with transition to test logger.
- make a common pool for query and table services. it is internal to the service and therefore
  easier without symbols. the exception for table service s.pool.withSession should be a separate hack
  for backward compatibility.  common session - remeber about diff - keepalive or alive stream
- retry in table service, with redesigning the repeats to repeat the whole session, not individual methods
- redoing the repeats in the other services - !!!RELEASE fix
- adding object contexts, needed for tracing in the future.  check on SLO
