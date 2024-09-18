package cmd

import (
	"fmt"
	"io"
	"maps"
	"net/url"
	"slices"

	"github.com/ipld/go-ipld-prime"
	"github.com/ipld/go-ipld-prime/codec/dagjson"
	"github.com/ipld/go-ipld-prime/schema"
	"github.com/multiformats/go-multibase"
	"github.com/storacha/go-ucanto/client"
	"github.com/storacha/go-ucanto/core/delegation"
	"github.com/storacha/go-ucanto/core/invocation"
	"github.com/storacha/go-ucanto/core/message"
	"github.com/storacha/go-ucanto/did"
	"github.com/storacha/go-ucanto/principal"
	ed25519 "github.com/storacha/go-ucanto/principal/ed25519/signer"
	rsa "github.com/storacha/go-ucanto/principal/rsa/signer"
	"github.com/storacha/go-ucanto/transport/http"
	"github.com/storacha/go-ucanto/ucan"
	"github.com/urfave/cli/v2"
)

type invokeOut struct {
	headers invokeOutHeaders
	body    []byte
}

type invokeOutHeaders struct {
	Keys   []string
	Values map[string][]string
}

func invokeOutType() schema.Type {
	ts, err := ipld.LoadSchemaBytes([]byte(`
		type InvokeOut struct {
		  headers { String: [String] }
			body Bytes
		}
	`))
	if err != nil {
		panic(fmt.Errorf("failed to load IPLD schema: %w", err))
	}
	return ts.TypeByName("InvokeOut")
}

type anynb struct {
	node ipld.Node
}

func (nb anynb) ToIPLD() (ipld.Node, error) {
	if nb.node == nil {
		return ucan.NoCaveats{}.ToIPLD()
	}
	return nb.node, nil
}

func Invoke(cCtx *cli.Context) error {
	serviceURL, err := url.Parse(cCtx.String("url"))
	if err != nil {
		return fmt.Errorf("parsing service URL: %w", err)
	}
	issuer, err := parseIssuer(cCtx.String("issuer"))
	if err != nil {
		return fmt.Errorf("parsing issuer key: %w", err)
	}
	audience, err := did.Parse(cCtx.String("audience"))
	if err != nil {
		return fmt.Errorf("parsing audience DID: %w", err)
	}
	resource, err := did.Parse(cCtx.String("resource"))
	if err != nil {
		return fmt.Errorf("parsing resource DID: %w", err)
	}
	ability := cCtx.String("ability")
	if ability == "" {
		return fmt.Errorf(`invalid ability: "%s"`, ability)
	}
	var caveats anynb
	if cCtx.String("caveats") != "" {
		nd, err := ipld.Decode([]byte(cCtx.String("caveats")), dagjson.Decode)
		if err != nil {
			return fmt.Errorf("decoding caveats: %w", err)
		}
		caveats = anynb{nd}
	}

	var proofs delegation.Proofs
	if cCtx.String("proof") != "" {
		_, bytes, err := multibase.Decode(cCtx.String("proof"))
		if err != nil {
			return fmt.Errorf("decoding proof: %w", err)
		}
		dlg, err := delegation.Extract(bytes)
		if err != nil {
			return fmt.Errorf("extracting delegation: %w", err)
		}
		proofs = append(proofs, delegation.FromDelegation(dlg))
	}

	capability := ucan.NewCapability(ability, resource.String(), caveats)
	inv, err := invocation.Invoke(issuer, audience, capability, delegation.WithProofs(proofs))
	if err != nil {
		return fmt.Errorf("issuing invocation: %w", err)
	}

	ch := http.NewHTTPChannel(serviceURL)
	conn, err := client.NewConnection(audience, ch)
	if err != nil {
		return fmt.Errorf("creating connection: %w", err)
	}

	input, err := message.Build([]invocation.Invocation{inv}, nil)
	if err != nil {
		return fmt.Errorf("building message: %s", err)
	}

	req, err := conn.Codec().Encode(input)
	if err != nil {
		return fmt.Errorf("encoding message: %s", err)
	}

	res, err := conn.Channel().Request(req)
	if err != nil {
		return fmt.Errorf("sending message: %s", err)
	}

	bytes, err := io.ReadAll(res.Body())
	if err != nil {
		return fmt.Errorf("reading response: %s", err)
	}

	hdrs := invokeOutHeaders{
		Keys:   slices.Collect(maps.Keys(res.Headers())),
		Values: res.Headers(),
	}

	json, err := ipld.Marshal(dagjson.Encode, &invokeOut{hdrs, bytes}, invokeOutType())
	if err != nil {
		return fmt.Errorf("encoding response: %s", err)
	}

	fmt.Println(string(json))
	return nil
}

func parseIssuer(s string) (principal.Signer, error) {
	signer, err := ed25519.Parse(s)
	if err != nil {
		// try rsa
		signer, err = rsa.Parse(s)
		if err != nil {
			return nil, err
		}
	}
	return signer, nil
}
