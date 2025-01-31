import React, { useState, useEffect, FC } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { useAuthRequest, TokenResponse } from 'expo-auth-session';
import { CommonActions } from '@react-navigation/native';
import { useToast } from 'native-base';
import { Keyboard } from 'react-native';

import Layout from '../components/Oauth';
import secureKeys from '../constants/oauth';
import { discovery, redirectUri } from '../lib/oauth';
import { RootState, RootDispatch } from '../store';
import { ContainerPropType, OauthConfigType } from './types';
import ToastAlert from '../components/UI/ToastAlert';

const OauthContainer: FC = ({ navigation }: ContainerPropType) => {
  const toast = useToast();
  const { loading } = useSelector((state: RootState) => state.loading.models.firefly);
  const configuration = useSelector((state: RootState) => state.configuration);
  const dispatch = useDispatch<RootDispatch>();

  const {
    backendURL,
    faceId,
  } = configuration;

  const [config, setConfig] = useState<OauthConfigType>({
    oauthClientId: '',
    oauthClientSecret: '',
  });

  const {
    oauthClientId,
    oauthClientSecret,
  } = config;

  const [request, result, promptAsync] = useAuthRequest(
    {
      clientId: oauthClientId,
      clientSecret: oauthClientSecret,
      redirectUri,
    },
    discovery(backendURL),
  );

  const goToHome = () => navigation.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [
        { name: 'dashboard' },
      ],
    }),
  );

  useEffect(() => {
    (async () => {
      const tokens = await SecureStore.getItemAsync(secureKeys.tokens);
      const storageValue = JSON.parse(tokens);
      if (storageValue && storageValue.accessToken && backendURL) {
        axios.defaults.headers.Authorization = `Bearer ${storageValue.accessToken}`;

        try {
          if (!TokenResponse.isTokenFresh(storageValue)) {
            await dispatch.firefly.getFreshAccessToken(storageValue.refreshToken);
          }
        } catch (e) {
          toast.show({
            render: ({ id }) => (
              <ToastAlert
                onClose={() => toast.close(id)}
                title="Something went wrong"
                status="error"
                variant="solid"
                description={`Failed to get accessToken, ${e.message}`}
              />
            ),
          });
        }
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (result?.type === 'cancel') {
        toast.show({
          render: ({ id }) => (
            <ToastAlert
              onClose={() => toast.close(id)}
              title="Info"
              status="info"
              variant="solid"
              description="Authentication cancel, check Client ID & backend URL."
            />
          ),
        });
      }
      if (result?.type === 'success') {
        try {
          const { code } = result.params;

          const payload = {
            oauthClientId,
            oauthClientSecret,
            codeVerifier: request.codeVerifier,
            code,
          };
          Keyboard.dismiss();

          await dispatch.firefly.getNewAccessToken(payload);
          await dispatch.firefly.testAccessToken();

          toast.show({
            render: ({ id }) => (
              <ToastAlert
                onClose={() => toast.close(id)}
                title="Success"
                status="success"
                variant="solid"
                description="Secure connexion ready with your Firefly III instance."
              />
            ),
          });
          goToHome();
        } catch (e) {
          toast.show({
            render: ({ id }) => (
              <ToastAlert
                onClose={() => toast.close(id)}
                title="Something went wrong"
                status="error"
                variant="solid"
                description={`Failed to get accessToken, ${e.message}`}
              />
            ),
          });
        }
      }
    })();
  }, [result]);

  return (
    <Layout
      config={config}
      loading={loading}
      faceId={faceId}
      backendURL={backendURL}
      faceIdCheck={goToHome}
      setConfig={setConfig}
      promptAsync={promptAsync}
      setBackendURL={dispatch.configuration.setBackendURL}
    />
  );
};

export default OauthContainer;
