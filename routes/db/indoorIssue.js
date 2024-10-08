const express = require("express");
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// indoorIssueRoutes is an instance of the express router.
// We use it to define our routes.
// The router will be added as a middleware and will take control of requests starting with path /app/indoorIssue.
const indoorIssueRoutes = express.Router();

// This will help us connect to the database
const pool = require("../../connections/pool");

// Get a list of all the indoorIssues.
indoorIssueRoutes.get("/app/indoorIssue/all", async (req, res, next) => {
    try {
        const { rows } = await pool.query('SELECT * FROM Issue');
        res.json(rows);
    } catch (error) {
        next(error);
    }
});

// Get a list of all the indoorIssues of specific categories.
indoorIssueRoutes.route("/app/indoorIssue/filtered").post(async (req, res, next) => {
    try {
        const categories = req.body.category;
        const placeholders = categories.map((_, index) => `$${index + 1}`).join(', ');

        const queryText = `
            SELECT Issue.*
            FROM Issue
            JOIN IssuesAndCategories ON Issue.issue_id = IssuesAndCategories.issue_id
            WHERE IssuesAndCategories.category IN (${placeholders});
        `;

        const { rows } = await pool.query(queryText, categories);
        res.json(rows);
    } catch (error) {
        next(error);
    }
});

// Get a single indoorIssue by id
indoorIssueRoutes.get("/app/indoorIssue/:id", async (req, res, next) => {
    try {
        const { rows } = await pool.query('SELECT * FROM Issue WHERE issue_id = $1', [req.params.id]);
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).send('Issue not found');
        }
    } catch (error) {
        next(error);
    }
});

// Create a new indoorIssue.
indoorIssueRoutes.route("/app/indoorIssue/add").post(upload.single('image'), async (req, res, next) => {
    const { avoidPolygon, location, latitude, longitude, description, status, datetimeOpen, datetimeClosed, datetimePermanent, votes } = req.body;
    
    // convert image buffer to base64 if image exists
    const image = req.file ? req.file.buffer.toString('base64') : null; 
    
    const queryText = `
        INSERT INTO Issue(avoidPolygon, location, latitude, longitude, description, status, datetimeOpen, datetimeClosed, datetimePermanent, votes)
        VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING issue_id;
    `;

    try {
        await pool.query('BEGIN');
        const { rows } = await pool.query(queryText, [avoidPolygon, location, latitude, longitude, description, status, datetimeOpen, datetimeClosed, datetimePermanent, votes || 0]);
        const issueId = rows[0].issue_id;

        // inserts the image into a second table, connected to the issues table by ID
            // IssueImages is not a real part of database, not sure if we want images in the same table or seperate
        
        if (image) {
            const imageQueryText = "INSERT INTO IssueImages(issue_id, image) VALUES($1, $2)";
            await pool.query(imageQueryText, [issueId, image]);
        }

        await pool.query('COMMIT');

        res.status(200).json({
            message: "Successfully added indoor issue",
            data: rows[0]
        });
    } catch (error) {
        await pool.query('ROLLBACK');
        next(error);
    }
});

// Update an indoorIssue by id.
indoorIssueRoutes.route("/app/indoorIssue/update/:id").patch(async (req, res, next) => {
    const issueId = req.params.id;
    const updates = req.body;
    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map((key, index) => `"${key}" = $${index + 2}`).join(', ');

    const queryText = `UPDATE Issue SET ${setClause} WHERE issue_id = $1 RETURNING *`;

    try {
        const { rows } = await pool.query(queryText, [issueId, ...values]);
        if (rows.length > 0) {
            res.status(200).json({
                message: "Successfully updated indoor issue",
                data: rows[0]
            });
        } else {
            res.status(404).json({ message: "Indoor issue not found" });
        }
    } catch (error) {
        next(error);
    }
});
// Delete an indoorIssue by id.
indoorIssueRoutes.route("/app/indoorIssue/delete/:id").delete(async (req, res, next) => {
    const issueId = req.params.id;
    const queryText = `DELETE FROM Issue WHERE issue_id = $1 RETURNING *`;

    try {
        const { rows } = await pool.query(queryText, [issueId]);
        if (rows.length > 0) {
            res.status(200).json({
                message: "Successfully deleted indoor issue",
                data: rows[0]
            });
        } else {
            res.status(404).json({
                message: "Indoor issue not found",
                id: issueId
            });
        }
    } catch (error) {
        next(error);
    }
});

module.exports = indoorIssueRoutes;