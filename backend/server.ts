
import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "shbs_researchflow",
  waitForConnections: true,
  connectionLimit: 10,
});

// Validate an optional date in YYYY-MM-DD format.
function isValidDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function getOptionalDate(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (!isValidDate(value)) {
    return undefined;
  }

  return value;
}

// Log an activity without preventing a study operation from succeeding.
async function logActivity(
  studyCode: string,
  studyName: string,
  action: string,
  description: string
): Promise<void> {
  try {
    await pool.execute(
      `INSERT INTO activity_logs
       (study_code, study_name, action, description)
       VALUES (?, ?, ?, ?)`,
      [studyCode, studyName, action, description]
    );
  } catch (error) {
    console.error("Could not save activity log:", error);
  }
}

// Health check
app.get("/", (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: "SHBS ResearchFlow API is running",
  });
});

app.get("/api/health", async (_req: Request, res: Response) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      success: true,
      message: "Backend and MySQL are connected",
    });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

// Get all studies, including their real deadline dates.
app.get("/api/studies", async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         study_code AS id,
         name,
         lead_name AS \`lead\`,
         status,
         progress,
         due,
         DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date
       FROM studies
       ORDER BY created_at DESC`
    );

    res.json(rows);
  } catch (error) {
    console.error("Could not fetch studies:", error);
    res.status(500).json({ message: "Failed to fetch studies" });
  }
});

// Get upcoming and overdue deadlines, ordered by date.
app.get("/api/deadlines", async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         study_code AS id,
         name,
         lead_name AS \`lead\`,
         status,
         progress,
         DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date,
         CASE
           WHEN due_date < CURDATE() THEN 'Overdue'
           ELSE 'Upcoming'
         END AS deadline_status
       FROM studies
       WHERE due_date IS NOT NULL
         AND status <> 'Completed'
       ORDER BY due_date ASC`
    );

    res.json(rows);
  } catch (error) {
    console.error("Could not fetch deadlines:", error);
    res.status(500).json({ message: "Failed to fetch deadlines" });
  }
});

// Get recent activity
app.get("/api/activities", async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         id,
         study_code,
         study_name,
         action,
         description,
         created_at
       FROM activity_logs
       ORDER BY created_at DESC, id DESC
       LIMIT 10`
    );

    res.json(rows);
  } catch (error) {
    console.error("Could not fetch activities:", error);
    res.status(500).json({ message: "Failed to fetch activities" });
  }
});

// Create a study
app.post("/api/studies", async (req: Request, res: Response) => {
  try {
    const {
      id,
      studyCode,
      name,
      lead,
      status,
      progress,
      due,
      dueDate,
    } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ message: "Study name is required" });
      return;
    }

    const deadline = getOptionalDate(dueDate);

    if (deadline === undefined) {
      res.status(400).json({
        message: "Deadline must be a valid date in YYYY-MM-DD format",
      });
      return;
    }

    const studyCodeValue =
      studyCode || id || `ST-${Date.now()}`;

    const leadValue = lead || "Samaira";
    const statusValue = status || "Active";
    const progressValue = Number(progress ?? 0);
    const dueValue = due || "Not scheduled";

    if (
      !Number.isInteger(progressValue) ||
      progressValue < 0 ||
      progressValue > 100
    ) {
      res.status(400).json({
        message: "Progress must be a number between 0 and 100",
      });
      return;
    }

    await pool.execute(
      `INSERT INTO studies
       (study_code, name, lead_name, status, progress, due, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        studyCodeValue,
        name.trim(),
        leadValue,
        statusValue,
        progressValue,
        dueValue,
        deadline,
      ]
    );

    await logActivity(
      studyCodeValue,
      name.trim(),
      "created",
      `Created study "${name.trim()}"`
    );

    res.status(201).json({
      success: true,
      message: "Study created successfully",
      id: studyCodeValue,
    });
  } catch (error) {
    console.error("Could not create study:", error);
    res.status(500).json({
      message: "Failed to create study. Check that the study code is unique.",
    });
  }
});

// Update a study
app.put("/api/studies/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, lead, status, progress, due, dueDate } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ message: "Study name is required" });
      return;
    }

    const deadline = getOptionalDate(dueDate);

    if (deadline === undefined) {
      res.status(400).json({
        message: "Deadline must be a valid date in YYYY-MM-DD format",
      });
      return;
    }

    const progressValue = Number(progress);

    if (
      !Number.isInteger(progressValue) ||
      progressValue < 0 ||
      progressValue > 100
    ) {
      res.status(400).json({
        message: "Progress must be a number between 0 and 100",
      });
      return;
    }

    const [existingRows] = await pool.execute(
      `SELECT name FROM studies WHERE study_code = ?`,
      [id]
    );

    const existing = (existingRows as { name: string }[])[0];

    if (!existing) {
      res.status(404).json({ message: "Study not found" });
      return;
    }

    await pool.execute(
      `UPDATE studies
       SET name = ?,
           lead_name = ?,
           status = ?,
           progress = ?,
           due = ?,
           due_date = ?
       WHERE study_code = ?`,
      [
        name.trim(),
        lead || "Samaira",
        status || "Active",
        progressValue,
        due || "Not scheduled",
        deadline,
        id,
      ]
    );

    await logActivity(
      id,
      name.trim(),
      "updated",
      `Updated study "${name.trim()}"`
    );

    res.json({
      success: true,
      message: "Study updated successfully",
    });
  } catch (error) {
    console.error("Could not update study:", error);
    res.status(500).json({ message: "Failed to update study" });
  }
});

// Delete a study
app.delete("/api/studies/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.execute(
      `SELECT name FROM studies WHERE study_code = ?`,
      [id]
    );

    const study = (rows as { name: string }[])[0];

    if (!study) {
      res.status(404).json({ message: "Study not found" });
      return;
    }

    await pool.execute(
      `DELETE FROM studies WHERE study_code = ?`,
      [id]
    );

    await logActivity(
      id,
      study.name,
      "deleted",
      `Deleted study "${study.name}"`
    );

    res.json({
      success: true,
      message: "Study deleted successfully",
    });
  } catch (error) {
    console.error("Could not delete study:", error);
    res.status(500).json({ message: "Failed to delete study" });
  }
});

// Start server after verifying the database and activity table.
async function startServer(): Promise<void> {
  try {
    await pool.query("SELECT 1 FROM activity_logs LIMIT 1");

    app.listen(PORT, () => {
      console.log(`SHBS ResearchFlow API running at http://localhost:${PORT}`);
      console.log("MySQL connection verified.");
    });
  } catch (error) {
    console.error(
      "Could not start server. Check MySQL and the activity_logs table:",
      error
    );
    process.exit(1);
  }
}

startServer();
