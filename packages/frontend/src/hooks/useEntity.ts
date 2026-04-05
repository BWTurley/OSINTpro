import { useCallback } from 'react';
import { useMutation, useQuery, useLazyQuery } from '@apollo/client';
import { GET_ENTITY, SEARCH_ENTITIES } from '@/graphql/queries/entities';
import {
  CREATE_ENTITY,
  UPDATE_ENTITY,
  MERGE_ENTITIES,
  DELETE_ENTITY,
} from '@/graphql/mutations/entities';
import { useEntityStore } from '@/stores/entityStore';
import type { Entity, EntityType } from '@/types';

export function useEntity(entityId?: string) {
  const { setSelectedEntity, cacheEntity, cacheEntities } = useEntityStore();

  const { data, loading, error, refetch } = useQuery(GET_ENTITY, {
    variables: { id: entityId },
    skip: !entityId,
    onCompleted: (result) => {
      if (result?.entity) {
        cacheEntity(result.entity);
      }
    },
  });

  const [searchEntities, { data: searchData, loading: searchLoading }] =
    useLazyQuery(SEARCH_ENTITIES, {
      onCompleted: (result) => {
        if (result?.searchEntities?.entities) {
          cacheEntities(result.searchEntities.entities);
        }
      },
    });

  const [createEntityMutation] = useMutation(CREATE_ENTITY);
  const [updateEntityMutation] = useMutation(UPDATE_ENTITY);
  const [mergeEntitiesMutation] = useMutation(MERGE_ENTITIES);
  const [deleteEntityMutation] = useMutation(DELETE_ENTITY);

  const createEntity = useCallback(
    async (input: {
      type: EntityType;
      value: string;
      label?: string;
      tags?: string[];
      tlp?: string;
    }) => {
      const result = await createEntityMutation({ variables: { input } });
      const entity = result.data?.createEntity as Entity;
      if (entity) {
        cacheEntity(entity);
      }
      return entity;
    },
    [createEntityMutation, cacheEntity]
  );

  const updateEntity = useCallback(
    async (id: string, input: Record<string, unknown>) => {
      const result = await updateEntityMutation({ variables: { id, input } });
      const entity = result.data?.updateEntity as Entity;
      if (entity) {
        cacheEntity(entity);
      }
      return entity;
    },
    [updateEntityMutation, cacheEntity]
  );

  const mergeEntities = useCallback(
    async (sourceIds: string[], targetId: string) => {
      const result = await mergeEntitiesMutation({
        variables: { sourceIds, targetId },
      });
      return result.data?.mergeEntities as Entity;
    },
    [mergeEntitiesMutation]
  );

  const deleteEntity = useCallback(
    async (id: string) => {
      const result = await deleteEntityMutation({ variables: { id } });
      return result.data?.deleteEntity as { success: boolean; message: string };
    },
    [deleteEntityMutation]
  );

  const search = useCallback(
    (query: string, options?: { types?: EntityType[]; limit?: number; offset?: number }) => {
      searchEntities({
        variables: {
          query,
          types: options?.types,
          limit: options?.limit ?? 25,
          offset: options?.offset ?? 0,
        },
      });
    },
    [searchEntities]
  );

  return {
    entity: (data?.entity as Entity) ?? null,
    loading,
    error,
    refetch,
    searchResults: searchData?.searchEntities?.entities as Entity[] | undefined,
    searchTotal: searchData?.searchEntities?.total as number | undefined,
    searchLoading,
    search,
    createEntity,
    updateEntity,
    mergeEntities,
    deleteEntity,
    setSelectedEntity,
  };
}
