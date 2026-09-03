package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
)

type ScanDevice struct {
	ID                  string   `json:"id"`
	Name                string   `json:"name"`
	Driver              string   `json:"driver"`
	SupportsFeeder      bool     `json:"supportsFeeder"`
	SupportsDuplex      bool     `json:"supportsDuplex"`
	SupportedDpi        []int    `json:"supportedDpi"`
	SupportedColorModes []string `json:"supportedColorModes"`
}

type JsonRpcResponse struct {
	JsonRpc string      `json:"jsonrpc"`
	ID      string      `json:"id"`
	Result  interface{} `json:"result,omitempty"`
}

func main() {
	port := 42100
	log.Printf("Starting EDRMS Desktop Scanner Agent on 127.0.0.1:%d", port)

	http.HandleFunc("/status", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status":  "RUNNING",
			"version": "0.1.0",
		})
	})

	http.HandleFunc("/devices", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Content-Type", "application/json")
		devices := []ScanDevice{
			{
				ID:                  "twain:Canon_DR-C225_II",
				Name:                "Canon imageFORMULA DR-C225 II",
				Driver:              "TWAIN",
				SupportsFeeder:      true,
				SupportsDuplex:      true,
				SupportedDpi:        []int{150, 200, 300, 600},
				SupportedColorModes: []string{"COLOR", "GRAYSCALE", "BLACK_WHITE"},
			},
		}
		json.NewEncoder(w).Encode(devices)
	})

	addr := fmt.Sprintf("127.0.0.1:%d", port)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatalf("Failed to start scanner agent: %v", err)
	}
}
