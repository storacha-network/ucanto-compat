package main

import (
	"log"
	"os"

	"github.com/storacha/ucanto-compat/cmd"
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
						Usage:  "Generate a private key.",
						Action: cmd.KeyGen,
						Flags: []cli.Flag{
							&cli.StringFlag{
								Name:  "type",
								Value: "ed25519",
								Usage: `key type to generate ("ed25519" or "rsa")`,
							},
						},
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
			{
				Name:   "invoke",
				Usage:  "Issue an invocation.",
				Action: cmd.Invoke,
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:  "url",
						Usage: "service URL",
					},
					&cli.StringFlag{
						Name:  "issuer",
						Usage: "base64 encoded _private_ key of the issuer",
					},
					&cli.StringFlag{
						Name:  "audience",
						Usage: "DID of the intended receipient (typically the service DID)",
					},
					&cli.StringFlag{
						Name:  "resource",
						Usage: "DID of the resource the invocation applies to",
					},
					&cli.StringFlag{
						Name:  "ability",
						Usage: "name of the capability to delegate (may be specified multiple times)",
					},
					&cli.StringFlag{
						Name:  "caveats",
						Usage: "dag-json encoded parameters for the invocation",
					},
					&cli.StringFlag{
						Name:  "proof",
						Usage: "base64 encoded archive of delegations to include as proofs",
					},
				},
			},
		},
	}

	if err := app.Run(os.Args); err != nil {
		log.Fatal(err)
	}
}
