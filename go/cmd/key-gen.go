package cmd

import (
	"fmt"
	"strings"

	"github.com/ipld/go-ipld-prime"
	"github.com/ipld/go-ipld-prime/codec/dagjson"
	ed25519 "github.com/storacha/go-ucanto/principal/ed25519/signer"
	rsa "github.com/storacha/go-ucanto/principal/rsa/signer"
	"github.com/urfave/cli/v2"
)

type keyGenOut struct {
	id  string
	key []byte
}

func KeyGen(cCtx *cli.Context) error {
	var id string
	var key []byte
	if strings.ToLower(cCtx.String("type")) == "rsa" {
		signer, err := rsa.Generate()
		if err != nil {
			return err
		}
		id = signer.DID().String()
		key = signer.Encode()
	} else {
		signer, err := ed25519.Generate()
		if err != nil {
			return err
		}
		id = signer.DID().String()
		key = signer.Encode()
	}

	json, err := ipld.Marshal(dagjson.Encode, &keyGenOut{id, key}, nil)
	if err != nil {
		return fmt.Errorf("encoding response: %s", err)
	}

	fmt.Println(string(json))
	return nil
}
