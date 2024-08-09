package main

import (
	"log"
	"os"

	"github.com/storacha-network/ucanto-compat/cmd"
	"github.com/urfave/cli/v2"
)

func main() {
	app := &cli.App{
		Commands: []*cli.Command{
			{
				Name: "key",
				Subcommands: []*cli.Command{
					{
						Name:   "gen",
						Usage:  "Generate an Ed25519 key.",
						Action: cmd.KeyGen,
					},
				},
			},
			{
				Name: "server",
				Subcommands: []*cli.Command{
					{
						Name:   "start",
						Usage:  "Start a Ucanto server.",
						Action: cmd.ServerStart,
					},
				},
			},
		},
	}

	if err := app.Run(os.Args); err != nil {
		log.Fatal(err)
	}
}
