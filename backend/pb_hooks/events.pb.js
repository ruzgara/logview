// Returns {"hasUsers": bool} without requiring auth, so the frontend can
// decide whether to show the first-run setup screen or the login form.

onRecordCreateRequest((e) => {
    const routerName = e.record.get("router");
    const serviceName = e.record.get("service");

    let router;
    try {
        router = $app.findFirstRecordByData("routers", "name", routerName);
    } catch {
        const routersCollection = $app.findCollectionByNameOrId("routers");
        router = new Record(routersCollection);
        router.set("name", routerName);
        $app.save(router);
    }

    let service;
    try {
        service = $app.findFirstRecordByData("services", "name", serviceName);
    } catch {
        const servicesCollection = $app.findCollectionByNameOrId("services");
        service = new Record(servicesCollection);
        service.set("name", serviceName);
        $app.save(service);
    }

    e.record.set("router", router.id);
    e.record.set("service", service.id);
    e.next();
}, "connections")