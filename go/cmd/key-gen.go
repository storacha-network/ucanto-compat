package cmd

import (
	"fmt"

	ed25519 "github.com/storacha-network/go-ucanto/principal/ed25519/signer"
	"github.com/urfave/cli/v2"
)

func KeyGen(cCtx *cli.Context) error {
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
}
