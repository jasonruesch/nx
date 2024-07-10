use std::rc::Rc;

use chrono::{DateTime, Utc};
use itertools::Itertools;
use napi::bindgen_prelude::*;
use rusqlite::vtab::array;
use rusqlite::vtab::array::Array;
use rusqlite::{params, params_from_iter, types::Value, Connection};

use crate::native::db::connect_to_nx_db;

#[napi(object)]
pub struct TaskRun {
    pub hash: String,
    pub status: String,
    pub project: String,
    pub target: String,
    pub configuration: Option<String>,
    pub code: i16,
    pub start: String,
    pub end: String,
}

#[napi]
pub struct NxTaskHistory {
    db: Connection,
}

#[napi]
impl NxTaskHistory {
    #[napi(constructor)]
    pub fn new(workspace_data_path: String) -> anyhow::Result<Self> {
        let s = Self {
            db: connect_to_nx_db(&workspace_data_path)?,
        };

        s.setup()?;

        Ok(s)
    }

    fn setup(&self) -> anyhow::Result<()> {
        array::load_module(&self.db)?;
        self.db
            .execute_batch(
                "
            BEGIN;
            CREATE TABLE IF NOT EXISTS task_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                hash TEXT NOT NULL,
                status TEXT NOT NULL,
                project TEXT NOT NULL,
                target TEXT NOT NULL,
                configuration TEXT,
                code INTEGER NOT NULL,
                start TIMESTAMP NOT NULL,
                end TIMESTAMP NOT NULL
            );
            COMMIT;
            ",
            )
            .map_err(anyhow::Error::from)
    }

    #[napi]
    pub fn record_task_runs(&self, task_runs: Vec<TaskRun>) -> anyhow::Result<()> {
        for task_run in task_runs.iter() {
            self.db
                .execute(
                    "
            INSERT INTO task_history
                (hash, status, project, target, configuration, code, start, end)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    params![
                        task_run.hash,
                        task_run.status,
                        task_run.project,
                        task_run.target,
                        task_run.configuration,
                        task_run.code,
                        task_run.start,
                        task_run.end
                    ],
                )
                .map_err(anyhow::Error::from)?;
        }
        Ok(())
    }

    #[napi]
    pub fn get_flaky_tasks(&self, hashes: Vec<String>) -> anyhow::Result<Vec<String>> {
        let values = Rc::new(
            hashes
                .iter()
                .map(|s| Value::from(s.clone()))
                .collect::<Vec<Value>>(),
        );

        self.db
            .prepare(
                "SELECT hash from task_history
                    WHERE hash IN rarray(?1)
                    GROUP BY hash
                    HAVING COUNT(DISTINCT code) > 1
                ",
            )?
            .query_map([values], |row| {
                dbg!(row);
                Ok(row.get(0)?)
            })?
            .map(|r| r.map_err(anyhow::Error::from))
            .collect()
    }
}
