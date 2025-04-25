const mysql = require('mysql2/promise');
const { Client } = require('@elastic/elasticsearch');

const esClient = new Client({ node: 'http://localhost:9200', });

(async () => {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'demo_es_user',
    database: 'demo',
    password: 'demo_es_password',
    port: 33061,
  });

  const [users] = await connection.execute('SELECT * FROM users INNER JOIN user_auth ON(users.id = user_auth.id)');
  const bulkBody = [];

  for (const user of users) {

    const [userMessages] = await connection.execute(
      'SELECT * FROM user_messages WHERE user_id = ?',
      [user.id]
    );

    const [userLocations] = await connection.execute(
      'SELECT * FROM user_locations WHERE user_id = ?',
      [user.id]
    );

    const userDocument = {
      first_name: user.first_name,
      last_name: user.last_name,
      phone_number: user.phone_number,
      active: user.active === 1,
      email: user.email,
      locations: userLocations.map(location => ({
        location_id: location.id,
        country: location.country,
        city: location.city,
        address: location.address,
        zip_code: location.zip_code,
      })),
      messages: userMessages.map(message => ({
        message_id: message.id,
        message: message.message,
        created_at: message.created_at,
      })),
      created_at: user.created_at,
    };

    bulkBody.push({ index: { _index: 'users-demo', _id: user.user_id } });
    bulkBody.push(userDocument);
  }

  // Insert into Elasticsearch
  const response = await esClient.bulk({ refresh: true, body: bulkBody });

  console.log(response.items[0]);
  if (response.errors) {
    console.error('Error inserting data into Elasticsearch:', response.errors);
  }

  await connection.end();
})();
