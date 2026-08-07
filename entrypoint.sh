#!/bin/sh
npx prisma db push && node seed.js && exec node server.js
