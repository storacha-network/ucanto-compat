package main

import (
	"fmt"
	"log"
	"os"

	ed25519 "github.com/storacha-network/go-ucanto/principal/ed25519/signer"
	"github.com/urfave/cli/v2"
)

func main() {
	app := &cli.App{
		Commands: []*cli.Command{
			{
				Name: "key",
				Subcommands: []*cli.Command{
					{
						Name:  "gen",
						Usage: "generate a key",
						Action: func(cCtx *cli.Context) error {
							signer, err := ed25519.Generate()
							if err != nil {
								return err
							}

							str, err := ed25519.Format(signer)
							if err != nil {
								return err
							}

							fmt.Printf("{\"key\":\"%s\"}\n", str)
							return nil
						},
					},
				},
			},
		},
	}

	if err := app.Run(os.Args); err != nil {
		log.Fatal(err)
	}
}
