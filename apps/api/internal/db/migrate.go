package db

import (
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

// RunMigrations applies every pending up.sql in migrationsDir against
// the database referenced by databaseURL. Idempotent: when nothing is
// pending, returns nil and logs a no-op message. Called from the api
// binary at startup so a fresh deploy doesn't crash on missing tables.
//
// We deliberately use the file-system source rather than an embed.FS:
// the Dockerfile already COPYs apps/api/migrations into /app/migrations,
// and operators occasionally hot-edit a migration on the running pod
// during a database recovery. Both paths converge on file-based loading.
func RunMigrations(databaseURL, migrationsDir string) error {
	abs, err := filepath.Abs(migrationsDir)
	if err != nil {
		return fmt.Errorf("resolve migrations dir: %w", err)
	}
	if _, err := os.Stat(abs); err != nil {
		return fmt.Errorf("migrations dir %q not readable: %w", abs, err)
	}

	m, err := migrate.New("file://"+abs, databaseURL)
	if err != nil {
		return fmt.Errorf("init migrator: %w", err)
	}
	// migrate.Close returns a (sourceErr, dbErr) pair; we surface the
	// first non-nil one so a misbehaving close isn't silently swallowed.
	defer func() {
		if srcErr, dbErr := m.Close(); srcErr != nil {
			slog.Warn("migrate source close", "err", srcErr)
		} else if dbErr != nil {
			slog.Warn("migrate db close", "err", dbErr)
		}
	}()

	if err := m.Up(); err != nil {
		if errors.Is(err, migrate.ErrNoChange) {
			slog.Info("migrations: schema already up to date")
			return nil
		}
		return fmt.Errorf("apply migrations: %w", err)
	}

	version, _, verr := m.Version()
	if verr != nil {
		slog.Info("migrations: applied (version readback failed)", "err", verr)
		return nil
	}
	slog.Info("migrations: applied", "version", version)
	return nil
}
