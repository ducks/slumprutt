{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    # Node.js and package managers
    nodejs_22

    # TypeScript
    typescript

    # Development tools
    nodePackages.tsx
  ];

  shellHook = ''
    echo "🗺️  Slumprutt development environment"
    echo ""
    echo "Node.js: $(node --version)"
    echo "npm: $(npm --version)"
    echo ""
    echo "To get started:"
    echo "  Backend:  cd backend && npm install && npm run dev"
    echo "  Frontend: cd frontend && npm install && npm run dev"
    echo ""
  '';
}
