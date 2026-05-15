// distill is a thin role dispatcher. The Docker image ships api, bot, and
// worker binaries; this entrypoint execs the right one based on the
// DISTILL_ROLE env var (or the first positional argument). It lets a single
// container image back three kuso services without needing per-service CMD
// overrides (which kuso v0.9 doesn't support).
package main

import (
	"fmt"
	"os"
	"syscall"
)

func main() {
	role := os.Getenv("DISTILL_ROLE")
	if role == "" && len(os.Args) > 1 {
		role = os.Args[1]
	}

	binPath := map[string]string{
		"api":    "/app/api",
		"bot":    "/app/bot",
		"worker": "/app/worker",
	}[role]

	if binPath == "" {
		fmt.Fprintf(os.Stderr,
			"distill: unknown role %q — set DISTILL_ROLE to one of: api, bot, worker\n",
			role)
		os.Exit(2)
	}

	// Exec so PID 1 becomes the target binary — kube signals (SIGTERM on
	// rollouts, SIGKILL on timeout) reach the real process directly.
	if err := syscall.Exec(binPath, []string{binPath}, os.Environ()); err != nil {
		fmt.Fprintf(os.Stderr, "distill: exec %s failed: %v\n", binPath, err)
		os.Exit(1)
	}
}
