package cmd

import (
	"fmt"
	"io"
	"net"
	"net/http"
	"time"

	"github.com/ipld/go-ipld-prime/node/basicnode"
	"github.com/storacha-network/go-ucanto/core/invocation"
	"github.com/storacha-network/go-ucanto/core/ipld"
	"github.com/storacha-network/go-ucanto/core/result"
	"github.com/storacha-network/go-ucanto/principal"
	ed25519 "github.com/storacha-network/go-ucanto/principal/ed25519/signer"
	"github.com/storacha-network/go-ucanto/server"
	"github.com/storacha-network/go-ucanto/server/transaction"
	uhttp "github.com/storacha-network/go-ucanto/transport/http"
	"github.com/storacha-network/go-ucanto/ucan"
	"github.com/urfave/cli/v2"
)

type testEchoCaveats struct {
	Echo string
}

func (c *testEchoCaveats) Build() (map[string]ipld.Node, error) {
	data := map[string]ipld.Node{}
	b := basicnode.Prototype.String.NewBuilder()
	err := b.AssignString(c.Echo)
	if err != nil {
		return nil, err
	}
	data["echo"] = b.Build()
	return data, nil
}

type testEchoSuccess struct {
	Echo string
}

func (ok *testEchoSuccess) Build() (ipld.Node, error) {
	np := basicnode.Prototype.Any
	nb := np.NewBuilder()
	ma, _ := nb.BeginMap(1)
	ma.AssembleKey().AssignString("echo")
	ma.AssembleValue().AssignString(ok.Echo)
	ma.Finish()
	return nb.Build(), nil
}

func createServer(signer principal.Signer) (server.ServerView, error) {
	cap := ucan.NewCapability("test/echo", signer.DID().String(), &testEchoCaveats{})
	return server.NewServer(
		signer,
		server.WithServiceMethod("test/echo", server.Provide(cap, func(cap ucan.Capability[*testEchoCaveats], inv invocation.Invocation, ctx server.InvocationContext) (transaction.Transaction[*testEchoSuccess, ipld.Builder], error) {
			r := result.Ok[*testEchoSuccess, ipld.Builder](&testEchoSuccess{Echo: cap.Nb().Echo})
			return transaction.NewTransaction(r), nil
		})),
	)
}

func ServerStart(cCtx *cli.Context) error {
	signer, err := ed25519.Generate()
	if err != nil {
		return err
	}

	server, err := createServer(signer)
	if err != nil {
		return err
	}

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		res, err := server.Request(uhttp.NewHTTPRequest(r.Body, r.Header))
		if err != nil {
			fmt.Printf("error: %+v", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		for key, vals := range res.Headers() {
			for _, v := range vals {
				w.Header().Add(key, v)
			}
		}

		if res.Status() != 0 {
			w.WriteHeader(res.Status())
		}

		_, err = io.Copy(w, res.Body())
		if err != nil {
			fmt.Printf("stream error: %s", err)
		}
	})

	listener, err := net.Listen("tcp", ":0")
	if err != nil {
		return err
	}

	http.HandleFunc("/shutdown", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusAccepted)
		go func() {
			time.Sleep(time.Second)
			listener.Close()
		}()
	})

	port := listener.Addr().(*net.TCPAddr).Port
	fmt.Printf("{\"id\":\"%s\",\"url\":\"http://127.0.0.1:%d\"}\n", signer.DID().String(), port)

	http.Serve(listener, nil)
	return nil
}
