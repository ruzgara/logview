// pb_hooks/api_keys.js

routerUse((e) => {
  // 1. Fast-exit: Skip middleware instantly if header is absent
  const accessKey = e.request.header.get("X-Access-Key");
  if (!accessKey) {
    return e.next();
  }

  // 2. Route restriction: Only process target endpoints
  const path = e.request.url.path;
  if (!path.startsWith("/api/collections/")) {
    return e.next();
  }

  const hash = $security.sha256(accessKey);
  const cacheKey = "accesskey_" + hash;

  // 3. Optional Memory Cache Lookup via PocketBase Store to bypass DB hits
  let userId = $app.store().get(cacheKey);

  if (!userId) {
    try {
      const agent = $app.findFirstRecordByFilter(
        "agents",
        "access_key_hash = {:hash}",
        { hash }
      );

      userId = agent.get("owner");
      $app.store().set(cacheKey, userId);
    } catch (err) {
      if (!err.toString().includes("sql: no rows in result set")) {
        console.log("Access Key Auth Error: " + err.toString());
      }
      return e.next();
    }
  }

  if (userId) {
    try {
      // Resolve owner and assign to auth context
      e.auth = $app.findRecordById("users", userId);
    } catch (err) {
      // Handle edge case where user record was deleted but key remains
    }
  }

  return e.next();
});

onRecordDelete((e) => {
  const hash = e.record.get("access_key_hash");
  if (hash) {
    $app.store().remove("accesskey_" + hash);
  }
  e.next();
}, "agents");

routerAdd("POST", "/api/generate_agent", (e) => {
  if (!e.auth) {
    throw new UnauthorizedError();
  }

  const body = e.requestInfo().body;
  const { agent_type, agent_source } = body;

  if (!agent_type || !agent_source) {
    throw new BadRequestError("agent_type and agent_source are required");
  }

  // Generates high-entropy token prefix for scanning capabilities
  const rawKey = "lv_" + $security.randomString(40);
  const keyHash = $security.sha256(rawKey);

  const agentsCollection = $app.findCollectionByNameOrId("agents");
  const agent = new Record(agentsCollection);
  
  agent.set("owner",           e.auth.id);
  agent.set("type",            agent_type);
  agent.set("source",          agent_source);
  agent.set("access_key_hash", keyHash);

  $app.save(agent);

  return e.json(200, {
    created_at: agent.get("created"),
    key:      rawKey,
  });
}, $apis.requireAuth());