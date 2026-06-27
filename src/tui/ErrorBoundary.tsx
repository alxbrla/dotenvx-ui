import { Box, Text } from "ink";
import React from "react";

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <Box flexDirection="column" paddingX={2} paddingY={1}>
          <Text bold color="red">
            dotenvx-ui crashed
          </Text>
          <Text>{this.state.error.message}</Text>
          <Box marginTop={1}>
            <Text dimColor>
              Please report this at https://github.com/alxbrla/dotenvx-ui/issues
            </Text>
          </Box>
        </Box>
      );
    }
    return this.props.children;
  }
}
