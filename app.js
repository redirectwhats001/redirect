const express = require('express');
const app = express();

const dotenv = require('dotenv');
dotenv.config();

const { Client } = require('pg');
const {
    DB_USER,
    HOST,
    DATABASE,
    PASSWORD,
    PORT,
    DB_PORT,
    DEFAULT_URL,
    MAX_CLICKS_PER_LINK
} = process.env;

const client = new Client({
    user: DB_USER,
    host: HOST,
    database: DATABASE,
    password: PASSWORD,
    port: DB_PORT,
    ssl: true
});

const qtd = MAX_CLICKS_PER_LINK;
const default_url = DEFAULT_URL;

const linear_order = 'SELECT * FROM links WHERE clicks < $1 ORDER BY id ASC LIMIT 1;';
const random_order = 'SELECT id, link, clicks FROM links WHERE clicks < $1 ORDER BY clicks ASC LIMIT 1;';

client.connect(async function (err) {
    if (err) throw err;
    console.log("Connected!");

    // REDIRECT
    app.get('/visit', async (req, res) => {
        const { type } = req.query;
        const { rows } = await client.query(type == 'random' ? random_order : linear_order, [qtd]);
        if (!rows.length) return res.redirect(default_url);
        await client.query('UPDATE links SET clicks=$2 WHERE link=$1', [rows[0].link, rows[0].clicks + 1]);
        return res.redirect(rows[0].link);
    });

    app.get('/', async (req, res) => {
        const { type } = req.query;
        const { rows } = await client.query(type == 'random' ? random_order : linear_order, [qtd]);
        return res.json({
            count: rows.length,
            available_links: rows.map(r => (r.link))
        });
    });

    // Show All Links and counted clicks
    app.get('/links', async (req, res) => {
        const { rows } = await client.query('SELECT * FROM links;');

        // Generate HTML table with the formatted data
        let tableRows = rows.map(row => `
            <tr>
                <td style="text-align:center;">${row.id}</td>
                <td style="text-align:center;"><a href="${row.link}" target="_blank" style="text-decoration:none; color:black;">${row.link}</a></td>
                <td style="text-align:center;"><b style="color:red;">${row.clicks}</b></td>
            </tr>
        `).join('');

        res.send(`
            <html>
            <head><title>Links</title></head>
            <body>
                <h1 style="text-align:center;">Links and Clicks</h1>
                <table border="1" style="border-collapse: collapse; width: 80%; margin: auto;">
                    <thead>
                        <tr>
                            <th style="padding: 10px; border: 1px solid black; text-align:center; background-color: #4682b4;">ID</th>
                            <th style="padding: 10px; border: 1px solid black; text-align:center; background-color: #4682b4;">Links</th>
                            <th style="padding: 10px; border: 1px solid black; text-align:center; background-color: #4682b4;">Clicks</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </body>
            </html>
        `);
    });

    // ADD MORE LINKS
    app.get('/add', async (req, res) => {
        const { link } = req.query;
        try {
            if (!link) res.redirect(`/links`);
            await client.query('INSERT INTO links(link, clicks) values ($1, 0);', [link]);
        } catch (error) {}
        return res.redirect(`/links`);
    });

    // Remove link
    app.get('/remove', async (req, res) => {
        const { link } = req.query;
        try {
            await client.query('DELETE FROM links WHERE link = $1', [link]);
        } catch (error) {}
        return res.redirect(301, `/links`);
    });

    // Reset clicks
    app.get('/reset', async (req, res) => {
        try {
            await client.query('UPDATE links SET clicks = 0 WHERE TRUE;');
        } catch (error) {}
        return res.redirect(301, `/links`);
    });

    app.listen(PORT, () => {
        console.log(`Example app listening on port ${PORT}`);
    });
});
