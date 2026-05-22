/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1325916001")

  // remove field
  collection.fields.removeById("text1171452453")

  // remove field
  collection.fields.removeById("text3785202386")

  // add field
  collection.fields.addAt(5, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_3239884372",
    "help": "",
    "hidden": false,
    "id": "relation1171452453",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "router",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1325916001")

  // add field
  collection.fields.addAt(5, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text1171452453",
    "max": 0,
    "min": 0,
    "name": "router",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(6, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text3785202386",
    "max": 0,
    "min": 0,
    "name": "service",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // remove field
  collection.fields.removeById("relation1171452453")

  return app.save(collection)
})
